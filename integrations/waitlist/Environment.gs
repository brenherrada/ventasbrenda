// Immutable per-version setting. Preview deployment uses a generated copy with
// 'preview'; the production template remains 'production'. Never read this mode
// from a caller, URL, request header or a mutable Script Property.
const INTAKE_ENVIRONMENT = 'production';
function intakeProperties_() {
  if (['production', 'preview'].indexOf(INTAKE_ENVIRONMENT) === -1) throw new Error('Unknown intake environment');
  const properties = PropertiesService.getScriptProperties();
  const prefix = INTAKE_ENVIRONMENT === 'preview' ? 'PREVIEW_' : '';
  const allowed = ['WAITLIST_SHEET_ID', 'WAITLIST_SECRET', 'WAITLIST_TAB_ID', 'PRODUCTS_SHEET_ID', 'PRODUCTS_FOLDER_ID', 'PRODUCTS_QA_ID', 'PRODUCTS_QA_SESSION'];
  const name = key => { if (allowed.indexOf(key) === -1) throw new Error('Unknown intake property'); return prefix + key; };
  return {
    getProperty: key => {
      const value = properties.getProperty(name(key));
      if (prefix && value && ['WAITLIST_SHEET_ID', 'WAITLIST_SECRET', 'PRODUCTS_FOLDER_ID'].indexOf(key) !== -1 && value === properties.getProperty(key)) throw new Error('Preview cannot share production destinations or secrets');
      return value;
    },
    setProperty: (key, value) => properties.setProperty(name(key), value),
    deleteProperty: key => properties.deleteProperty(name(key))
  };
}
