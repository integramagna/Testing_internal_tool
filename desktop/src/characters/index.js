const loaders = {
  reminders: () => import('./reminders.js'),
  reports: () => import('./reports.js'),
  dispatch: () => import('./dispatch.js'),
}

export const loadCharacter = async (roleSlug) => {
  const loader = loaders[roleSlug]
  if (!loader) {
    throw new Error(`Unknown character role: ${roleSlug}`)
  }
  const module = await loader()
  return module.variant
}
