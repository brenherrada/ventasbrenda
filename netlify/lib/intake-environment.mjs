// Platform context is authoritative. A request cannot opt into preview writes.
export function intakeEnvironment(context, get) {
  if (context?.deploy?.context === 'production') return 'production';
  if (context?.deploy?.context === 'deploy-preview' && get('WAITLIST_PREVIEW_ENABLED') === 'true') return 'preview';
  return null;
}
export function intakeGetter(get, environment) {
  if (environment !== 'preview') return get;
  return key => {
    if (key === 'WAITLIST_SCRIPT_URL') return get('PREVIEW_WAITLIST_SCRIPT_URL');
    if (key === 'WAITLIST_SCRIPT_SECRET') return get('PREVIEW_WAITLIST_SCRIPT_SECRET');
    if (key === 'CATALOG_SOURCE') return 'bridge';
    if (['CATALOG_SPREADSHEET_ID', 'CATALOG_GOOGLE_CREDENTIALS'].includes(key)) return undefined;
    return get(key);
  };
}
