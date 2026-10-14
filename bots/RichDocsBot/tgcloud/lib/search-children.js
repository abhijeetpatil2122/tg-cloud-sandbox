export function createChildItems(parent) {
  if (parent.kind === 'method') {
    return (parent.params || []).map((param) => ({
      kind: 'parameter',
      name: parent.name + '.' + param.name,
      childName: param.name,
      title: parent.name + ' · ' + param.name,
      category: parent.category || 'Bot API method',
      description: param.description,
      descriptionRich: param.descriptionRich,
      parentName: parent.name,
      parentUrl: parent.url,
      parentTitle: parent.title,
      param,
      searchText: (parent.name + ' ' + param.name + ' ' + param.type + ' ' + param.description).toLowerCase(),
    }));
  }
  if (parent.kind === 'type') {
    return (parent.properties || []).map((property) => ({
      kind: 'field',
      name: parent.name + '.' + property.name,
      childName: property.name,
      title: parent.name + ' · ' + property.name,
      category: 'Field of ' + parent.name,
      description: property.description,
      descriptionRich: property.descriptionRich,
      parentName: parent.name,
      parentUrl: parent.url,
      parentTitle: parent.title,
      property,
      searchText: (parent.name + ' ' + property.name + ' ' + property.type + ' ' + property.description).toLowerCase(),
    }));
  }
  return [];
}
