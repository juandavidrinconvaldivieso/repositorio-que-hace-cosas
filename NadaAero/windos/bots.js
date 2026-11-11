// El último bot inútil que queda (vive solo en tu PC)
const BOTS = {
  'bot:nada': {
    profile: { name: 'Nada', status: 'online', msg: '...', mood: 'sueno', temp: null,
      about: 'No hago nada. Soy muy bueno en eso.\nSoy el último bot inútil que queda.', avatar: { type: 'icon', id: 'nada' } },
    reply(t) {
      if (t.includes('?')) return { text: 'nada' };
      const x = pick(['...', 'nada', '.', 'mm', ':|', 'ok', null, '|-)', '(nada)', 'no', null]);
      return { text: x, typing: x === null ? 3500 : 1200, nudge: Math.random() < .08 };
    }
  }
};
