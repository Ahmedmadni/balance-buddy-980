import {registerPlugin} from "@capacitor/core";
export interface DocumentSaveResult {saved:boolean}
export const RasdDocumentSave = registerPlugin<{
  saveEncryptedDocument(options:{fileName:string;sha256:string}):Promise<DocumentSaveResult>;
}>("RasdDocumentSave");
