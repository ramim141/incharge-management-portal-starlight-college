// Department / section / gender filter groups built from the in-charge's own class settings.
// A group with a single option is hidden by FilterButton, so unused groupings never show up.
const countBy = (students, key, value) => students.filter((s) => s.status !== 'inactive' && s[key] === value).length;

export function studentFilterGroups(settings, students) {
  const all = { value: 'All', label: 'সব' };
  const groups = [];
  const departments = settings.departments || [];
  const sections = settings.sections || [];
  if (departments.length) {
    groups.push({ key: 'group', label: 'বিভাগ', options: [all, ...departments.map((d) => ({ value: d.id, label: d.bn, count: countBy(students, 'group', d.id) }))] });
  }
  if (sections.length) {
    groups.push({ key: 'section', label: 'শাখা', options: [all, ...sections.map((d) => ({ value: d.id, label: d.bn, count: countBy(students, 'section', d.id) }))] });
  }
  if (settings.useGender !== false) {
    groups.push({
      key: 'gender',
      label: 'ছাত্র / ছাত্রী',
      options: [all, { value: 'Male', label: 'ছাত্র', count: countBy(students, 'gender', 'Male') }, { value: 'Female', label: 'ছাত্রী', count: countBy(students, 'gender', 'Female') }],
    });
  }
  return groups;
}

export const matchStudentFilter = (s, f) =>
  (!f.group || f.group === 'All' || s.group === f.group) &&
  (!f.section || f.section === 'All' || s.section === f.section) &&
  (!f.gender || f.gender === 'All' || s.gender === f.gender);
