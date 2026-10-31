// Explicit trusted-host wiring only. No metadata service, header or env lookup.
// A reviewed Node host supplies this identity; it is not hardware attestation.
export function persistentInstallation(value){
 const fields=['format','instanceArn','releaseSha256','processId','environment'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||value.format!==1||!['instanceArn','releaseSha256','processId','environment'].every(k=>typeof value[k]==='string')||
  !/^arn:aws:lightsail:us-east-2:[0-9]{12}:Instance\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.instanceArn)||
  !/^[a-f0-9]{64}$/.test(value.releaseSha256)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.processId)||
  !['preview','production'].includes(value.environment))throw Error('alliance_persistent_installation_unavailable');
 return {...value};
}
