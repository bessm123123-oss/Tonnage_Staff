(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TonnageFormat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseJson(text) {
    if (typeof text !== 'string') throw new Error('Файл не содержит текстовых данных.');
    const clean = text.replace(/^\uFEFF/, '').trim();
    if (!clean) throw new Error('Файл пуст.');
    try { return JSON.parse(clean); }
    catch (_error) { throw new Error('В файле повреждён JSON.'); }
  }

  function kind(raw) {
    if (raw && raw.format === 'tonnage-planning' && [1, 2].includes(Number(raw.formatVersion)) && raw.data) return 'planning';
    if (raw && raw.format === 'tonnage-database' && Number(raw.formatVersion) === 1 && raw.database && raw.planning) return 'database';
    return null;
  }

  function parseAndValidate(text) {
    const raw = parseJson(text);
    const type = kind(raw);
    if (!type) throw new Error('Формат не поддерживается. Нужен .tonnage v1/v2 или .tonnage-db v1.');
    return { raw, type };
  }

  function safeFilename(value, fallback) {
    const clean = String(value || '')
      .normalize('NFKC')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-. ]+|[-. ]+$/g, '')
      .slice(0, 70);
    return clean || fallback;
  }

  return { parseJson, kind, parseAndValidate, safeFilename };
});
