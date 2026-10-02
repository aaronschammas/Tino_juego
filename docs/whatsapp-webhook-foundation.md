# Base del webhook WhatsApp

## Contrato HTTP

- `GET /whatsapp/webhook`: con modo `subscribe`, verify token y challenge válidos,
  responde el challenge exacto como `text/plain`. Usa `@Res()` exclusivamente en
  este handler; el interceptor global y el envelope del resto de la API siguen
  intactos. Solicitudes inválidas reciben 403; sin verify token configurado, 503.
- `POST /whatsapp/webhook`: requiere `WHATSAPP_APP_SECRET` y
  `WHATSAPP_PHONE_NUMBER_ID`. Si falta alguno responde 503 antes de procesar.
  Verifica HMAC sobre el raw body; una firma inválida recibe 403.
- Cada change debe contener `value.metadata.phone_number_id` igual al canal
  configurado. Changes de otros canales o sin metadata se ignoran antes de
  identificar personas, deduplicar o escribir en Tino. Se responde 200 para
  reconocer la entrega; un batch mixto solo procesa el canal permitido.
- Los webhooks deben apuntar al backend directamente, no al proxy del frontend.

## Identidad y multiempresa

La identidad persistente sigue siendo el business-scoped `user_id` de Meta,
guardado en `Organization.whatsappUserId`. No se introduce una identidad basada
en teléfono ni un modelo nuevo.

Para cada mensaje, se busca un contacto por `message.from == contact.wa_id` o
`message.from_user_id == contact.user_id`. Nunca se usa su posición en el array.
Contactos ambiguos o identificadores contradictorios se rechazan. Se utiliza
`from_user_id` directo o el `user_id` del contacto coincidente. Si no existe
ninguno, el mensaje se ignora. `from` y `wa_id` solo sirven para correlacionar y
contestar en ese momento; no se persisten como identidad.

El contexto se obtiene exclusivamente de la vinculación en la base: identidad
Meta → organización vinculada activa con `plan.hasWhatsApp` → cuenta del owner
activa y membership `ORG_OWNER` vigente. Los IDs de selección del menú solo
pueden elegir una organización de ese conjunto. Cookies, `X-Organization-Id` o
IDs arbitrarios enviados por el usuario no seleccionan el tenant del webhook.

Al canjear un código también se revalidan cuenta activa, organización activa,
feature y ownership. No se debe confundir una organización activa en DB con la
organización seleccionada en el navegador: esta última no interviene aquí.

## Verificación y pendientes

La suite HTTP importa `AppModule`, con su interceptor y filtro global, y utiliza
raw body y ValidationPipe como el bootstrap. Prisma y WhatsAppClientService se
reemplazan por mocks; no conecta PostgreSQL ni llama a Meta.

Pendientes para trabajos posteriores: validar los campos de identidad contra un
payload real sanitizado de la cuenta Meta; recuperación durable de fallos después
de deduplicar; rate limit distribuido; retención de hashes; consumo transaccional
de códigos y carreras entre autorización y escritura. Este cambio no incorpora
comandos, CRM, modelos, migraciones, frontend ni modificaciones Trello/Assistant.
