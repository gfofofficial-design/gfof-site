import {createWatchtowerServerHandler} from './_shared/watchtower-server.mjs';
export default createWatchtowerServerHandler({kind:'worker'});
export const config={path:'/api/watchtower/process-one'};
