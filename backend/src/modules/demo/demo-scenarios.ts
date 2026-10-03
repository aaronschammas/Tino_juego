export type DemoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DemoStageKind = 'spread' | 'explode' | 'escalate';

/**
 * Consecuencia de no atender un problema: cuando su "peligro" (segundos sin resolver, el doble si se
 * trabaja en algo menos urgente) llega a `at`, aparece en Tino la tarea `spawn`.
 */
export interface DemoStage {
  at: number;
  kind: DemoStageKind;
  message: string;
  spawn: DemoTaskDef & { parent?: string };
}

/** Tarea del escenario. Las que tienen `subtasks` son padres sin acción: se trabaja en cada subtarea. */
export interface DemoTaskDef {
  title: string;
  description: string;
  priority: DemoPriority;
  action?: string;
  workSeconds?: number;
  subtasks?: DemoTaskDef[];
  stages?: DemoStage[];
}

export interface DemoScenario {
  key: string;
  name: string;
  intro: string;
  tasks: DemoTaskDef[];
}

/** Una tarea del escenario, venga de la carga inicial o de una consecuencia. */
export interface DemoTaskEntry {
  def: DemoTaskDef;
  parentTitle: string | null;
  spawned: boolean;
}

/** Escenarios del juego. Cada tarea con `action` es un objeto que el juego sabe dibujar y animar. */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'oficina',
    name: 'La oficina en llamas',
    intro: 'Se prendieron fuego el servidor y la impresora, el cliente llama furioso y la planta se seca.',
    tasks: [
      {
        title: 'Apagar el incendio',
        description: 'Hay dos focos de fuego. Cada uno es una subtarea: iniciá el timer en la subtarea.',
        priority: 'CRITICAL',
        subtasks: [
          {
            title: 'Fuego en el servidor',
            description: 'El rack echa llamas. Si no se apaga, se extiende y explota.',
            priority: 'CRITICAL',
            action: 'servidor',
            workSeconds: 12,
            stages: [
              {
                at: 30,
                kind: 'spread',
                message: '¡El fuego del servidor se extendió al archivo!',
                spawn: {
                  title: 'Fuego en el archivo',
                  description: 'El fuego pasó del servidor al archivo.',
                  priority: 'CRITICAL',
                  action: 'archivo',
                  workSeconds: 10,
                  parent: 'Apagar el incendio',
                },
              },
              {
                at: 55,
                kind: 'explode',
                message: '¡Explotó el servidor!',
                spawn: {
                  title: 'Limpiar los restos del servidor',
                  description: 'La explosión dejó escombros por toda la oficina.',
                  priority: 'MEDIUM',
                  action: 'escombros',
                  workSeconds: 10,
                },
              },
            ],
          },
          {
            title: 'Fuego en la impresora',
            description: 'La impresora se recalentó y está en llamas.',
            priority: 'HIGH',
            action: 'impresora',
            workSeconds: 10,
            stages: [
              {
                at: 45,
                kind: 'explode',
                message: '¡Explotó la impresora y hay tóner por todos lados!',
                spawn: {
                  title: 'Limpiar el tóner',
                  description: 'El piso quedó negro de tóner.',
                  priority: 'LOW',
                  action: 'toner',
                  workSeconds: 8,
                },
              },
            ],
          },
        ],
      },
      {
        title: 'Atender al cliente furioso',
        description: 'El teléfono suena sin parar. Si nadie atiende, el cliente se enoja más.',
        priority: 'HIGH',
        action: 'telefono',
        workSeconds: 10,
        stages: [
          {
            at: 60,
            kind: 'escalate',
            message: 'El cliente se cansó de esperar y mandó un reclamo formal.',
            spawn: {
              title: 'Responder el reclamo formal',
              description: 'Llegó un mail con un reclamo. Hay que contestarlo.',
              priority: 'HIGH',
              action: 'mail',
              workSeconds: 10,
            },
          },
        ],
      },
      {
        title: 'Regar la planta',
        description: 'La planta de la oficina está mustia.',
        priority: 'LOW',
        action: 'planta',
        workSeconds: 8,
      },
    ],
  },
  {
    key: 'casa',
    name: 'La casa patas arriba',
    intro: 'Se prende fuego la sartén, la basura desborda y la casa es un desastre.',
    tasks: [
      {
        title: 'Apagar la sartén en llamas',
        description: 'La sartén se prendió fuego en la cocina. ¡Primero esto!',
        priority: 'CRITICAL',
        action: 'sarten',
        workSeconds: 10,
        stages: [
          {
            at: 28,
            kind: 'spread',
            message: '¡El fuego pasó a las cortinas!',
            spawn: {
              title: 'Fuego en las cortinas',
              description: 'Las cortinas de la cocina se prendieron fuego.',
              priority: 'CRITICAL',
              action: 'cortinas',
              workSeconds: 10,
            },
          },
          {
            at: 55,
            kind: 'explode',
            message: '¡Explotó la sartén y llenó la cocina de hollín!',
            spawn: {
              title: 'Limpiar el hollín de la cocina',
              description: 'Todo quedó negro de hollín.',
              priority: 'MEDIUM',
              action: 'hollin',
              workSeconds: 10,
            },
          },
        ],
      },
      {
        title: 'Sacar la basura',
        description: 'La bolsa desborda y ya hay moscas.',
        priority: 'HIGH',
        action: 'basura',
        workSeconds: 8,
        stages: [
          {
            at: 45,
            kind: 'escalate',
            message: 'La basura atrajo cucarachas.',
            spawn: {
              title: 'Fumigar las cucarachas',
              description: 'Aparecieron cucarachas por la basura acumulada.',
              priority: 'HIGH',
              action: 'cucarachas',
              workSeconds: 8,
            },
          },
        ],
      },
      {
        title: 'Ordenar la casa',
        description: 'Tres cosas para ordenar: cada una es una subtarea.',
        priority: 'MEDIUM',
        subtasks: [
          {
            title: 'Lavar los platos',
            description: 'La pileta está llena de platos sucios.',
            priority: 'MEDIUM',
            action: 'platos',
            workSeconds: 10,
          },
          {
            title: 'Barrer el living',
            description: 'Hay una montaña de polvo en la alfombra.',
            priority: 'LOW',
            action: 'polvo',
            workSeconds: 8,
          },
          {
            title: 'Hacer la cama',
            description: 'La cama quedó revuelta.',
            priority: 'LOW',
            action: 'cama',
            workSeconds: 6,
          },
        ],
      },
    ],
  },
  {
    key: 'jardin',
    name: 'El jardín abandonado',
    intro: 'Una canilla rota inunda todo, la parrilla quedó prendida y el jardín está descuidado.',
    tasks: [
      {
        title: 'Cerrar la canilla que inunda',
        description: 'La canilla del fondo pierde agua. Si sigue, se inunda el sótano y revienta el caño.',
        priority: 'CRITICAL',
        action: 'canilla',
        workSeconds: 8,
        stages: [
          {
            at: 25,
            kind: 'spread',
            message: '¡El agua llegó al sótano!',
            spawn: {
              title: 'Sacar el agua del sótano',
              description: 'Se inundó el sótano.',
              priority: 'HIGH',
              action: 'inundacion',
              workSeconds: 10,
            },
          },
          {
            at: 50,
            kind: 'explode',
            message: '¡Reventó el caño por la presión!',
            spawn: {
              title: 'Arreglar el caño reventado',
              description: 'El caño principal reventó.',
              priority: 'CRITICAL',
              action: 'cano',
              workSeconds: 10,
            },
          },
        ],
      },
      {
        title: 'Apagar la parrilla',
        description: 'Quedó la parrilla prendida y saltan chispas.',
        priority: 'HIGH',
        action: 'parrilla',
        workSeconds: 8,
        stages: [
          {
            at: 35,
            kind: 'spread',
            message: '¡Una chispa prendió el pasto seco!',
            spawn: {
              title: 'Fuego en el pasto seco',
              description: 'Se prendió fuego el pasto seco al lado de la parrilla.',
              priority: 'CRITICAL',
              action: 'pastizal',
              workSeconds: 8,
            },
          },
        ],
      },
      {
        title: 'Arreglar el jardín',
        description: 'Tres trabajos de jardín: cada uno es una subtarea.',
        priority: 'MEDIUM',
        subtasks: [
          {
            title: 'Regar la huerta',
            description: 'Las plantas de la huerta se están secando.',
            priority: 'HIGH',
            action: 'huerta',
            workSeconds: 10,
            stages: [
              {
                at: 60,
                kind: 'escalate',
                message: 'Se secó la huerta: hay que volver a plantar.',
                spawn: {
                  title: 'Replantar la huerta',
                  description: 'La huerta se secó del todo.',
                  priority: 'MEDIUM',
                  action: 'semillas',
                  workSeconds: 8,
                  parent: 'Arreglar el jardín',
                },
              },
            ],
          },
          {
            title: 'Cortar el pasto',
            description: 'El pasto está tan alto que no se ve el piso.',
            priority: 'MEDIUM',
            action: 'pasto',
            workSeconds: 10,
          },
          {
            title: 'Arreglar la cerca',
            description: 'Se cayó una parte de la cerca.',
            priority: 'LOW',
            action: 'cerca',
            workSeconds: 8,
          },
        ],
      },
    ],
  },
];

export const DEMO_SCENARIO_KEYS = DEMO_SCENARIOS.map((scenario) => scenario.key);

/** Nombre del proyecto de Tino donde viven las tareas del escenario. */
export function scenarioProjectName(scenario: DemoScenario): string {
  return `Feria · ${scenario.name}`;
}

export function findScenario(key: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((scenario) => scenario.key === key);
}

/** Todas las tareas posibles del escenario (iniciales, subtareas y consecuencias), en orden. */
export function flattenScenario(scenario: DemoScenario): DemoTaskEntry[] {
  const entries: DemoTaskEntry[] = [];
  const visit = (def: DemoTaskDef, parentTitle: string | null, spawned: boolean) => {
    entries.push({ def, parentTitle, spawned });
    for (const sub of def.subtasks ?? []) visit(sub, def.title, spawned);
    for (const stage of def.stages ?? []) visit(stage.spawn, stage.spawn.parent ?? null, true);
  };
  for (const task of scenario.tasks) visit(task, null, false);
  return entries;
}
