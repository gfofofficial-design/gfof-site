import {createWatchtowerServerHandler} from './_shared/watchtower-server.mjs';
export default createWatchtowerServerHandler({kind:'intake'});
export const config={path:'/api/watchtower/intake'};
