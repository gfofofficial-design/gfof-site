export const profileImagePath = '/api/alliance-members/me/image';
export const profileImageStatePath = profileImagePath + '/state';
export const profileImageContentPath = profileImagePath + '/content';
export const profileImageHeaders = Object.freeze({
  profile: 'x-alliance-image-profile',
  operation: 'x-alliance-image-operation',
  version: 'x-alliance-image-version',
});
export const profileImageTypes = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);
export const profileImageInputLimit = 2 * 1024 * 1024;
export const profileImageOutputLimit = 300 * 1024;
export const imageId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value) &&
  value !== '00000000-0000-0000-0000-000000000000';
export const imageVersion = value => Number.isSafeInteger(value) && value >= 0;
