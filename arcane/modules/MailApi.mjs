export {
    default,
    default as Mail,
    resolveMailConfig
} from './Mail.js?arcaneVersion=0.28.1';
export {
    MAIL_OUTBOX_IDEMPOTENCY_WINDOW_MS,
    MAIL_OUTBOX_PROTOCOL,
    MAIL_OUTBOX_STATES,
    MAIL_OUTBOX_TABLE,
    MailOutbox,
    createMailOutbox
} from './MailOutbox.mjs?arcaneVersion=0.28.1';
export {
    MailTransportError,
    normalizeMailEndpoint,
    sendMailReport,
    serializeMailReport
} from './MailTransport.mjs?arcaneVersion=0.28.1';
