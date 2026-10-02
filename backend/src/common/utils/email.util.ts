import * as dns from 'dns';
import { BadRequestException } from '@nestjs/common';

/**
 * Valida el formato del correo y verifica la existencia de registros MX en el dominio (DNS).
 * Incluye un timeout de 5 segundos para absorber demoras en la red o servidores DNS caídos.
 */
export async function validateEmailDomain(email: string): Promise<void> {
    // 1. Validar formato con Regex estricto
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new BadRequestException('El formato del correo electrónico es inválido');
    }

    // 2. Extraer el dominio
    const domain = email.split('@')[1];
    if (!domain) {
        throw new BadRequestException('El formato del correo electrónico es inválido');
    }

    // 3. Verificación de registros MX (Consulta DNS con timeout)
    try {
        const mxRecords = await Promise.race([
            dns.promises.resolveMx(domain),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DNS Timeout')), 5000)
            )
        ]);

        if (!mxRecords || mxRecords.length === 0) {
            throw new Error('No MX records');
        }
    } catch (error) {
        throw new BadRequestException('El dominio del email no es válido o no está configurado para recibir correos');
    }
}
