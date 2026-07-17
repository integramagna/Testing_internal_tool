const loaders = {
  nimbus: () => import('./nimbus.js'),
  pip: () => import('./pip.js'),
  bolt: () => import('./bolt.js'),
}

export const loadCharacter = async (id) => {
  const loader = loaders[id]
  if (!loader) {
    throw new Error(`Unknown character: ${id}`)
  }
  return loader()
}
