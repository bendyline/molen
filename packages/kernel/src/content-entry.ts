/**
 * Content libraries without the rest of the kernel (and without `ses`): build a type library from
 * loaded molen/types@1 documents, and compare content identities. Packages that hold or read
 * content import this subpath so their bundles never pull the SES script host.
 */
export { CONTENT_KEY, contentDrift, keyframeContent } from './content';
export {
  createTypeLibrary,
  type TypeLibrary,
  type TypeLibraryOptions,
} from './type-library';
