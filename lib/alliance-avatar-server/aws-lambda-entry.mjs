// Closed staging entry points only. No installation manifest, activation switch,
// environment flag, event-derived configuration or enabled runtime is supplied.
import {createAwsAccountGatewayRuntime,createAwsAccountAuthorityRuntime} from './account-aws-runtime.mjs';
const gateway=createAwsAccountGatewayRuntime(),authority=createAwsAccountAuthorityRuntime();
export const gatewayHandler=(event,context)=>gateway.handler(event,context);
export const authorityHandler=(event,context)=>authority.handler(event,context);
