// Public list of classes (code + name only) so the student portal can offer a class picker
// before sign-in. Kept in sync by the principal's app; readable by anyone (see firestore.rules).
export const CLASS_INDEX_PATH = ['meta', 'classIndex'];

export const buildClassIndex = (classes) =>
  [...classes]
    .map((c) => ({ code: c.code || c.id, name: c.name || c.id, section: c.section || '', session: c.session || '' }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
