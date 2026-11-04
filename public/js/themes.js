'use strict';
/* ═════════ Wavelength themes ═════════
   The single source of truth for the extra palettes. `scripts/gen-themes.js`
   turns this list into public/css/themes.css, and the Settings picker, the
   previews and the light/dark detection read it at runtime.

   For every theme:  bg = the page behind the panels (darkest in a dark theme),
   card = the panels, card2 = raised rows and inputs, plus three text levels
   and a default accent. Colours follow each project's published palette. */
(function (root) {
  const T = (id, name, sub, mode, bg, card, card2, text, text2, text3, accent) =>
    ({ id, name, sub, mode, bg, card, card2, text, text2, text3, accent });

  const groups = [
    {
      name: 'Editor classics',
      items: [
        T('dracula', 'Dracula', 'Dark · Purple', 'dark', '#1e1f29', '#282a36', '#343746', '#f8f8f2', '#c4c5d0', '#6272a4', '#bd93f9'),
        T('nord', 'Nord', 'Dark · Frost', 'dark', '#242933', '#2e3440', '#3b4252', '#eceff4', '#d8dee9', '#7b88a1', '#88c0d0'),
        T('gruvbox', 'Gruvbox', 'Dark · Retro', 'dark', '#1d2021', '#282828', '#3c3836', '#ebdbb2', '#bdae93', '#7c6f64', '#fabd2f'),
        T('gruvbox-light', 'Gruvbox Light', 'Light · Retro', 'light', '#ebdbb2', '#fbf1c7', '#f2e5bc', '#3c3836', '#665c54', '#9c8e7b', '#af3a03'),
        T('solarized-dark', 'Solarized Dark', 'Dark · Teal', 'dark', '#00212b', '#002b36', '#073642', '#93a1a1', '#8c9b9c', '#596f76', '#2aa198'),
        T('solarized-light', 'Solarized Light', 'Light · Cream', 'light', '#eee8d5', '#fdf6e3', '#f1ead4', '#586e75', '#586e75', '#879798', '#268bd2'),
        T('tokyo-night', 'Tokyo Night', 'Dark · Blue', 'dark', '#16161e', '#1a1b26', '#24283b', '#c0caf5', '#a9b1d6', '#58618b', '#7aa2f7'),
        T('tokyo-storm', 'Tokyo Storm', 'Dark · Violet', 'dark', '#1f2335', '#24283b', '#2f334d', '#c0caf5', '#a9b1d6', '#636c95', '#bb9af7'),
        T('one-dark', 'One Dark', 'Dark · Blue', 'dark', '#21252b', '#282c34', '#353b45', '#abb2bf', '#9da5b4', '#69707e', '#61afef'),
        T('one-light', 'One Light', 'Light · Blue', 'light', '#e5e5e6', '#fafafa', '#f0f0f1', '#383a42', '#696c77', '#95969d', '#4078f2'),
        T('monokai', 'Monokai', 'Dark · Lime', 'dark', '#1e1f1c', '#272822', '#3e3d32', '#f8f8f2', '#cfcfc2', '#75715e', '#a6e22e'),
        T('ayu-dark', 'Ayu Dark', 'Dark · Gold', 'dark', '#07090d', '#0b0e14', '#151a23', '#bfbdb6', '#8f9aa5', '#565b66', '#e6b450'),
        T('ayu-mirage', 'Ayu Mirage', 'Dark · Amber', 'dark', '#181c25', '#1f2430', '#2a3140', '#cccac2', '#9aa0ad', '#707a8c', '#ffcc66'),
        T('ayu-light', 'Ayu Light', 'Light · Orange', 'light', '#eceef0', '#fcfcfc', '#f3f4f5', '#5c6166', '#6c7075', '#93989d', '#c78528'),
        T('rose-pine', 'Rosé Pine', 'Dark · Rose', 'dark', '#131120', '#191724', '#26233a', '#e0def4', '#908caa', '#6e6a86', '#ebbcba'),
        T('rose-pine-moon', 'Rosé Pine Moon', 'Dark · Iris', 'dark', '#1b1a2e', '#232136', '#393552', '#e0def4', '#a29eba', '#6e6a86', '#c4a7e7'),
        T('rose-pine-dawn', 'Rosé Pine Dawn', 'Light · Rose', 'light', '#f2e9e1', '#faf4ed', '#fffaf3', '#575279', '#706c8c', '#9590a3', '#c67874'),
        T('everforest', 'Everforest', 'Dark · Moss', 'dark', '#232a2e', '#2d353b', '#3a464c', '#d3c6aa', '#afb3a3', '#7a8478', '#a7c080'),
        T('everforest-light', 'Everforest Light', 'Light · Moss', 'light', '#efebd4', '#fdf6e3', '#f4f0d9', '#5c6a72', '#616f74', '#8c978f', '#859701'),
        T('kanagawa', 'Kanagawa', 'Dark · Wave', 'dark', '#16161d', '#1f1f28', '#2a2a37', '#dcd7ba', '#c8c093', '#727169', '#7e9cd8'),
        T('github-dark', 'GitHub Dark', 'Dark · Blue', 'dark', '#010409', '#0d1117', '#161b22', '#e6edf3', '#8b949e', '#6e7681', '#2f81f7'),
        T('github-light', 'GitHub Light', 'Light · Blue', 'light', '#eaeef2', '#ffffff', '#f6f8fa', '#1f2328', '#59636e', '#8c959f', '#0969da'),
        T('night-owl', 'Night Owl', 'Dark · Navy', 'dark', '#010e1a', '#011627', '#0b2942', '#d6deeb', '#a2b1c6', '#5f7e97', '#82aaff'),
        T('synthwave', 'Synthwave', 'Dark · Neon', 'dark', '#1c192b', '#262335', '#34294f', '#f4eeff', '#b6b1c9', '#7f7a9a', '#ff7edb'),
      ],
    },
    {
      name: 'Atmosphere',
      items: [
        T('midnight', 'Midnight', 'Black · Electric blue', 'dark', '#000000', '#070b16', '#0f1629', '#e8ecf8', '#99a2bd', '#5a6380', '#4f8cff'),
        T('ember', 'Ember', 'Black · Warm orange', 'dark', '#000000', '#0f0a08', '#1c1310', '#f6ece6', '#b39f95', '#6f5f57', '#ff6a3d'),
        T('forest', 'Forest', 'Dark · Green', 'dark', '#070d09', '#0c1510', '#16241b', '#e4efe6', '#98ad9e', '#5b6f61', '#4ade80'),
        T('ocean', 'Ocean', 'Dark · Cyan', 'dark', '#030d14', '#07171f', '#0f2a38', '#e1f1f7', '#94b3c0', '#587888', '#22d3ee'),
        T('coffee', 'Coffee', 'Dark · Caramel', 'dark', '#120d0a', '#1b1410', '#2a1f19', '#eddccb', '#b8a08c', '#7a6657', '#d4a373'),
        T('sunset', 'Sunset', 'Dark · Coral', 'dark', '#120a14', '#1a0f1c', '#2a1830', '#ffe8df', '#c5a4a4', '#836470', '#ff7a59'),
        T('paper', 'Paper', 'Light · Warm', 'light', '#e9e2d2', '#fbf8f1', '#f3eee3', '#2b2620', '#6a6155', '#9d9486', '#b45309'),
        T('mint', 'Mint', 'Light · Fresh', 'light', '#d9ebe3', '#f5fbf8', '#e7f3ee', '#12332a', '#4d7266', '#7b9d91', '#0f9d76'),
        T('lavender', 'Lavender', 'Light · Soft', 'light', '#dedaf0', '#f7f5fc', '#ece9f6', '#2a2540', '#6a6488', '#9690b1', '#7c5cf0'),
      ],
    },
  ];

  const byId = {};
  for (const g of groups) for (const t of g.items) byId[t.id] = t;
  const api = { groups, byId, all: Object.values(byId) };
  root.WLThemes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
