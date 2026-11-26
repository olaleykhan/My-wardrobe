import { useEffect, useMemo, useState } from 'react';

// Every image dropped into the results folder shows up here automatically.
const IMAGES = import.meta.glob('../results/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const FILES = Object.fromEntries(
  Object.entries(IMAGES).map(([p, url]) => [p.split('/').pop(), url]),
);

const FIELDS = [
  ['color', 'Colour'],
  ['brand', 'Brand'],
  ['type', 'Type'],
  ['size', 'Size'],
  ['notes', 'Notes'],
];
const CAN_EDIT = import.meta.env.DEV;
const EMPTY ={ name: '', color: '', brand: '', type: '', size: '', notes: '' };

// A readable name for an image that has no saved details yet.
function nameFromFile(file) {
  const base = file.replace(/\.[a-z]+$/i, '').replace(/^IMG_\d+-/, '').replace(/-/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

function Lightbox({ items, index, onClose, onMove }) {
  const item = items[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'ArrowLeft') onMove(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onMove]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.name} onClick={onClose}>
      <button className="nav prev" aria-label="Previous item" onClick={(e) => { e.stopPropagation(); onMove(-1); }}>‹</button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={item.url} alt={item.name} />
        <figcaption>
          <strong>{item.name}</strong>
          <span>{[item.color, item.brand, item.type, item.size].filter(Boolean).join(' · ')}</span>
        </figcaption>
      </figure>
      <button className="nav next" aria-label="Next item" onClick={(e) => { e.stopPropagation(); onMove(1); }}>›</button>
      <button className="close" aria-label="Close" onClick={onClose}>×</button>
    </div>
  );
}

function Card({ item, editing, onEdit, onSave, onCancel, onOpen }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (editing) setDraft(item); }, [editing, item]);

  const set = (field) => (e) => setDraft({ ...draft, [field]: e.target.value });
  const onKey = (e) => {
    if (e.key === 'Enter') onSave(draft);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <article className={'card' + (editing ? ' editing' : '')}>
      {item.type === 'To buy' && <span className="flag">To buy</span>}
      {item.isNew && <span className="flag new">New</span>}
      <button className="thumb" onClick={onOpen} aria-label={'View ' + item.name + ' larger'}>
        <img loading="lazy" src={item.url} alt={item.name} />
      </button>
      <div className="info" onKeyDown={editing ? onKey : undefined}>
        {editing ? (
          <>
            <input className="n" autoFocus value={draft.name} onChange={set('name')} aria-label="Name" />
            <dl>
              {FIELDS.map(([f, label]) => (
                <div className="row" key={f}>
                  <dt>{label}</dt>
                  <dd><input value={draft[f]} onChange={set(f)} aria-label={label} /></dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <>
            <p className="name">{item.name}</p>
            <dl>
              {FIELDS.map(([f, label]) => (
                <div className="row" key={f}>
                  <dt>{label}</dt>
                  <dd>{item[f]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {CAN_EDIT && <button
        className="pen"
        title={editing ? 'Save' : 'Edit'}
        aria-label={(editing ? 'Save ' : 'Edit ') + item.name}
        onClick={() => (editing ? onSave(draft) : onEdit())}
      >
        {editing ? <CheckIcon /> : <PenIcon />}
      </button>}
    </article>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    // On this PC the dev server reads and writes wardrobe.json; the hosted site ships a read-only copy.
    const load = CAN_EDIT
      ? fetch('/api/wardrobe').then((r) => r.json())
      : import('../wardrobe.json').then((m) => m.default);
    load
      .then(setData)
      .catch(() => { setData({}); setStatus("Couldn't load wardrobe.json"); });
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    const known = Object.keys(data).filter((f) => FILES[f]);
    const fresh = Object.keys(FILES).filter((f) => !data[f]).sort();
    return [...known, ...fresh].map((file) => ({
      ...EMPTY,
      name: nameFromFile(file),
      ...(data[file] || {}),
      file,
      url: FILES[file],
      isNew: !data[file],
    }));
  }, [data]);

  const types = useMemo(() => [...new Set(items.map((i) => i.type).filter(Boolean))], [items]);

  const shown = items.filter((i) => {
    if (type && i.type !== type) return false;
    const q = query.trim().toLowerCase();
    return !q || [i.name, i.color, i.brand, i.type, i.size, i.notes].join(' ').toLowerCase().includes(q);
  });

  async function save(file, draft) {
    const clean = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(draft[k] || '').trim()]));
    const next = { ...data, [file]: clean };
    setData(next);
    setEditing(null);
    try {
      const r = await fetch('/api/wardrobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!r.ok) throw new Error();
      setStatus('Saved to wardrobe.json');
    } catch (e) {
      setStatus("Couldn't save. Is the app still running?");
    }
  }

  if (!data) return <p className="loading">Loading…</p>;

  return (
    <>
      <header>
        <h1>Wardrobe catalogue</h1>
        <span className="count">{shown.length} of {items.length} items</span>
        <span className="status" role="status">{status}</span>
        <input type="search" placeholder="Search" aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </header>
      <main>
        {shown.map((item) => (
          <Card
            key={item.file}
            item={item}
            editing={editing === item.file}
            onEdit={() => setEditing(item.file)}
            onSave={(draft) => save(item.file, draft)}
            onCancel={() => setEditing(null)}
            onOpen={() => setOpen(item.file)}
          />
        ))}
      </main>
      {open && shown.some((i) => i.file === open) && (
        <Lightbox
          items={shown}
          index={shown.findIndex((i) => i.file === open)}
          onClose={() => setOpen(null)}
          onMove={(step) => {
            const at = shown.findIndex((i) => i.file === open);
            setOpen(shown[(at + step + shown.length) % shown.length].file);
          }}
        />
      )}
    </>
  );
}
