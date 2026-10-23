// Closed staging entry only. No installation, external trust pin, connection
// material, environment activation flag or enabled member runtime is supplied.
import {createAwsMemberAuthorityRuntime} from './member-aws-runtime.mjs';
const runtime=await createAwsMemberAuthorityRuntime();
export const memberAuthorityHandler=(event,context)=>runtime.handler(event,context);
