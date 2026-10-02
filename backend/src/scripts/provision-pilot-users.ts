import { OrganizationRole, PrismaClient, ProjectRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export type PilotUserInput = {
  email: string;
  name: string;
  lastname: string;
  organizationRole: OrganizationRole;
  passwordEnv?: string;
};

export type PilotProvisionConfig = {
  organizationName: string;
  projectName: string;
  planName: string;
  allowedEmailDomain: string;
  users: PilotUserInput[];
};

export type ProvisionSummary = {
  organization: { id: string; created: boolean };
  project: { id: string; created: boolean };
  users: Array<{
    email: string;
    userId: string;
    userCreated: boolean;
    passwordCreated: boolean;
    organizationDefaultPreserved: boolean;
  }>;
  temporaryPasswords: Array<{ email: string; password: string }>;
};

type PrismaLike = any;

const MIN_PASSWORD_LENGTH = 12;

export function validateConfig(
  config: PilotProvisionConfig,
): PilotProvisionConfig {
  if (!config || typeof config !== 'object')
    throw new Error('Configuracion invalida');

  const organizationName = config.organizationName?.trim();
  const projectName = config.projectName?.trim();
  const planName = config.planName?.trim();
  const allowedEmailDomain = config.allowedEmailDomain?.trim().toLowerCase();

  if (!organizationName || !projectName || !planName || !allowedEmailDomain) {
    throw new Error(
      'organizationName, projectName, planName y allowedEmailDomain son obligatorios',
    );
  }
  if (!Array.isArray(config.users) || config.users.length === 0) {
    throw new Error('Debe configurarse al menos un usuario piloto');
  }

  const emails = new Set<string>();
  const users = config.users.map((input, index) => {
    if ((input as any).password) {
      throw new Error(
        `users[${index}]: no se permite password en el archivo; use passwordEnv o generacion aleatoria`,
      );
    }

    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    const lastname = input.lastname?.trim();
    const passwordEnv = input.passwordEnv?.trim();

    if (!email || !name || !lastname) {
      throw new Error(
        `users[${index}]: email, name y lastname son obligatorios`,
      );
    }
    if (name.startsWith('REEMPLAZAR_') || lastname.startsWith('REEMPLAZAR_')) {
      throw new Error(
        `users[${index}]: reemplace los placeholders de nombre y apellido`,
      );
    }
    if (!email.endsWith(`@${allowedEmailDomain}`)) {
      throw new Error(
        `users[${index}]: el email debe pertenecer a @${allowedEmailDomain}`,
      );
    }
    if (emails.has(email))
      throw new Error(`Email duplicado en configuracion: ${email}`);
    emails.add(email);

    if (
      ![OrganizationRole.ORG_OWNER, OrganizationRole.ORG_MEMBER].includes(
        input.organizationRole,
      )
    ) {
      throw new Error(`users[${index}]: organizationRole invalido`);
    }
    if (passwordEnv && !/^[A-Z][A-Z0-9_]*$/.test(passwordEnv)) {
      throw new Error(
        `users[${index}]: passwordEnv debe ser un nombre de variable de entorno valido`,
      );
    }

    return {
      email,
      name,
      lastname,
      organizationRole: input.organizationRole,
      passwordEnv,
    };
  });

  if (
    !users.some((user) => user.organizationRole === OrganizationRole.ORG_OWNER)
  ) {
    throw new Error(
      'Debe existir al menos un ORG_OWNER para el proyecto piloto',
    );
  }

  return { organizationName, projectName, planName, allowedEmailDomain, users };
}

function generateTemporaryPassword(): string {
  return `${randomBytes(18).toString('base64url')}aA1!`;
}

function passwordFor(
  user: PilotUserInput,
  env: NodeJS.ProcessEnv,
): { password: string; generated: boolean } {
  const configured = user.passwordEnv ? env[user.passwordEnv] : undefined;
  if (user.passwordEnv && !configured) {
    throw new Error(
      `${user.email}: falta definir la variable ${user.passwordEnv}`,
    );
  }
  const generated = !configured;
  const password = configured || generateTemporaryPassword();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${user.email}: la password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    );
  }
  return { password, generated };
}

async function findExactlyOneByName(model: any, name: string, label: string) {
  const matches = await model.findMany({ where: { name } });
  if (matches.length > 1) {
    throw new Error(
      `${label}: hay mas de un registro llamado "${name}"; use IDs o corrija el duplicado antes de continuar`,
    );
  }
  return matches[0] ?? null;
}

export async function provisionPilotUsers(
  prisma: PrismaLike,
  rawConfig: PilotProvisionConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProvisionSummary> {
  const config = validateConfig(rawConfig);

  return prisma.$transaction(
    async (tx: PrismaLike) => {
      const userRole = await tx.role.findUnique({ where: { name: 'USER' } });
      if (!userRole)
        throw new Error(
          'No existe el rol global USER. Ejecute el seed base primero.',
        );

      const plan = await tx.plan.findUnique({
        where: { name: config.planName },
      });
      if (!plan)
        throw new Error(
          `No existe el plan "${config.planName}". Ejecute el seed base primero.`,
        );

      let organization = await findExactlyOneByName(
        tx.organization,
        config.organizationName,
        'Organizacion ambigua',
      );
      const organizationCreated = !organization;
      if (!organization) {
        organization = await tx.organization.create({
          data: {
            name: config.organizationName,
            planId: plan.id,
            isActive: true,
          },
        });
      } else if (!organization.isActive) {
        throw new Error(
          `La organizacion "${config.organizationName}" existe pero esta inactiva`,
        );
      }

      const provisioned: ProvisionSummary['users'] = [];
      const temporaryPasswords: ProvisionSummary['temporaryPasswords'] = [];
      const usersByEmail = new Map<string, any>();

      for (const input of config.users) {
        let user = await tx.user.findFirst({
          where: { email: { equals: input.email, mode: 'insensitive' } },
          include: { role: true },
        });
        const userCreated = !user;
        let passwordCreated = false;

        if (user) {
          if (user.role?.name?.trim() !== 'USER') {
            throw new Error(
              `${input.email}: el usuario existente tiene rol global ${user.role?.name || 'desconocido'}; no se modificara`,
            );
          }
          if (user.googleId || user.googleStatus) {
            throw new Error(
              `${input.email}: el usuario existente esta vinculado a Google; no se desvinculara automaticamente`,
            );
          }
          if (!user.isActive) {
            throw new Error(
              `${input.email}: el usuario existente esta inactivo; no se reactivara automaticamente`,
            );
          }
          if (!user.password) {
            const { password, generated } = passwordFor(input, env);
            const passwordHash = await bcrypt.hash(password, 12);
            user = await tx.user.update({
              where: { id: user.id },
              data: { password: passwordHash },
            });
            passwordCreated = true;
            if (generated)
              temporaryPasswords.push({ email: input.email, password });
          }
        } else {
          const { password, generated } = passwordFor(input, env);
          const passwordHash = await bcrypt.hash(password, 12);
          user = await tx.user.create({
            data: {
              id: randomUUID(),
              email: input.email,
              name: input.name,
              lastname: input.lastname,
              password: passwordHash,
              googleId: null,
              googleStatus: false,
              roleId: userRole.id,
              isActive: true,
              isEmailVerified: true,
              organizationId: organization.id,
            },
          });
          passwordCreated = true;
          if (generated)
            temporaryPasswords.push({ email: input.email, password });
        }

        const organizationDefaultPreserved = Boolean(
          user.organizationId && user.organizationId !== organization.id,
        );
        if (!user.organizationId) {
          user = await tx.user.update({
            where: { id: user.id },
            data: { organizationId: organization.id },
          });
        }

        await tx.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: user.id,
            },
          },
          create: {
            organizationId: organization.id,
            userId: user.id,
            role: input.organizationRole,
          },
          update: { role: input.organizationRole },
        });

        usersByEmail.set(input.email, user);
        provisioned.push({
          email: input.email,
          userId: user.id,
          userCreated,
          passwordCreated,
          organizationDefaultPreserved,
        });
      }

      const ownerInput = config.users.find(
        (user) => user.organizationRole === OrganizationRole.ORG_OWNER,
      )!;
      const owner = usersByEmail.get(ownerInput.email);
      let project = await findExactlyOneByName(
        {
          findMany: (args: any) =>
            tx.project.findMany({
              ...args,
              where: { ...args.where, organizationId: organization.id },
            }),
        },
        config.projectName,
        'Proyecto ambiguo',
      );
      const projectCreated = !project;
      if (!project) {
        project = await tx.project.create({
          data: {
            name: config.projectName,
            ownerId: owner.id,
            organizationId: organization.id,
            isActive: true,
          },
        });
      } else if (!project.isActive) {
        throw new Error(
          `El proyecto "${config.projectName}" existe pero esta inactivo`,
        );
      }

      for (const input of config.users) {
        const user = usersByEmail.get(input.email);
        const projectRole =
          project.ownerId === user.id ? ProjectRole.OWNER : ProjectRole.MEMBER;
        await tx.projectMember.upsert({
          where: {
            projectId_userId: { projectId: project.id, userId: user.id },
          },
          create: { projectId: project.id, userId: user.id, role: projectRole },
          update: {},
        });
      }

      return {
        organization: { id: organization.id, created: organizationCreated },
        project: { id: project.id, created: projectCreated },
        users: provisioned,
        temporaryPasswords,
      };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

async function loadConfig(path: string): Promise<PilotProvisionConfig> {
  return JSON.parse(
    await readFile(resolve(path), 'utf8'),
  ) as PilotProvisionConfig;
}

async function main() {
  const configPath = process.env.PILOT_CONFIG_PATH;
  if (!configPath)
    throw new Error(
      'Defina PILOT_CONFIG_PATH con la ruta al JSON local de configuracion',
    );
  const config = validateConfig(await loadConfig(configPath));
  const apply = process.argv.includes('--apply');

  if (!apply) {
    console.log('DRY RUN: configuracion valida. No se realizaron escrituras.');
    console.table(
      config.users.map(({ email, organizationRole, passwordEnv }) => ({
        email,
        organizationRole,
        passwordSource: passwordEnv
          ? `env:${passwordEnv}`
          : 'generada al aplicar',
      })),
    );
    console.log(
      `Organizacion: ${config.organizationName} | Proyecto: ${config.projectName} | Plan: ${config.planName}`,
    );
    console.log(
      'Para aplicar: establezca PILOT_PROVISION_CONFIRM con el nombre exacto de la organizacion y agregue --apply.',
    );
    return;
  }

  if (process.env.PILOT_PROVISION_CONFIRM !== config.organizationName) {
    throw new Error(
      'PILOT_PROVISION_CONFIRM no coincide exactamente con organizationName',
    );
  }

  const prisma = new PrismaClient();
  try {
    const summary = await provisionPilotUsers(prisma, config);
    console.log('Provisionamiento completado:');
    console.table(summary.users);
    console.log('Organizacion:', summary.organization);
    console.log('Proyecto:', summary.project);
    if (summary.temporaryPasswords.length) {
      console.warn(
        'CREDENCIALES TEMPORALES (se muestran una sola vez; entregarlas por un canal seguro):',
      );
      console.table(summary.temporaryPasswords);
    } else {
      console.log(
        'No hay passwords generadas para mostrar (se usaron variables de entorno o credenciales existentes).',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      'Provisionamiento cancelado:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
