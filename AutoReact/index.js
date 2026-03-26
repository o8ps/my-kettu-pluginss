/// AutoReact Plugin for Kettu / Bunny / Vendetta
/// Watches for messages from target user IDs and reacts automatically.

(function () {
  // ─── Storage helpers ────────────────────────────────────────────────────────
  const STORAGE_KEY = "autoreact_settings";

  function loadSettings() {
    try {
      const raw = vendetta.storage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSettings(s) {
    vendetta.storage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  // Default settings
  const DEFAULT = {
    enabled: true,
    userIds: [],          // array of string user IDs to watch
    emoji: "☠️",          // emoji to react with
    delayMs: 0,         // 0 – 1500 ms
  };

  let settings = Object.assign({}, DEFAULT, loadSettings() ?? {});

  // ─── Discord internals ───────────────────────────────────────────────────────
  const { findByProps } = vendetta.metro;

  // Module that exposes addReaction
  const ReactionModule = findByProps("addReaction");
  // Flux dispatcher so we can subscribe to MESSAGE_CREATE
  const FluxDispatcher = findByProps("dispatch", "subscribe", "unsubscribe");

  // ─── Core logic ─────────────────────────────────────────────────────────────
  let timeouts = [];

  function handleMessage({ message }) {
    if (!settings.enabled) return;
    if (!message || !message.author) return;
    if (!settings.userIds.includes(message.author.id)) return;
    if (!settings.emoji || settings.emoji.trim() === "") return;

    const delay = Math.max(0, Math.min(1500, settings.delayMs));

    const t = setTimeout(() => {
      try {
        ReactionModule.addReaction(
          message.channel_id,
          message.id,
          { id: null, name: settings.emoji }
        );
      } catch (e) {
        console.error("[AutoReact] Failed to react:", e);
      }
    }, delay);

    timeouts.push(t);
  }

  function subscribe() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessage);
  }

  function unsubscribe() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessage);
    timeouts.forEach(clearTimeout);
    timeouts = [];
  }

  // ─── Settings UI ────────────────────────────────────────────────────────────
  const { React } = vendetta.metro;
  const {
    Forms: { FormSection, FormRow, FormSwitch, FormInput, FormText },
    General: { Text, View, ScrollView },
  } = vendetta.ui.components;

  // Simple slider-like component using a text input for delay value
  function SettingsPanel() {
    const [enabled, setEnabled] = React.useState(settings.enabled);
    const [userIds, setUserIds] = React.useState(settings.userIds.join(", "));
    const [emoji, setEmoji] = React.useState(settings.emoji);
    const [delayMs, setDelayMs] = React.useState(String(settings.delayMs));

    function commit(patch) {
      Object.assign(settings, patch);
      saveSettings(settings);
    }

    return React.createElement(
      ScrollView,
      null,

      // ── Enable toggle ──
      React.createElement(
        FormSection,
        { title: "AutoReact" },
        React.createElement(FormRow, {
          label: "Enable AutoReact",
          trailing: React.createElement(FormSwitch, {
            value: enabled,
            onValueChange: (v) => {
              setEnabled(v);
              commit({ enabled: v });
            },
          }),
        })
      ),

      // ── Target user IDs ──
      React.createElement(
        FormSection,
        { title: "Target User IDs" },
        React.createElement(FormText, null,
          "Comma-separated list of user IDs to watch."
        ),
        React.createElement(FormInput, {
          placeholder: "123456789, 987654321",
          value: userIds,
          onChange: (v) => {
            setUserIds(v);
            const ids = v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => /^\d+$/.test(s));
            commit({ userIds: ids });
          },
        })
      ),

      // ── Emoji ──
      React.createElement(
        FormSection,
        { title: "Reaction Emoji" },
        React.createElement(FormText, null,
          "Enter a single emoji (e.g. 👍 ❤️ 😂). Custom emotes are not supported."
        ),
        React.createElement(FormInput, {
          placeholder: "👍",
          value: emoji,
          onChange: (v) => {
            setEmoji(v);
            commit({ emoji: v.trim() });
          },
        })
      ),

      // ── Delay ──
      React.createElement(
        FormSection,
        { title: `Reaction Delay: ${delayMs} ms  (0 – 1500)` },
        React.createElement(FormText, null,
          "0 = nearly instant. 1500 = 1.5 second delay."
        ),
        React.createElement(FormInput, {
          placeholder: "500",
          value: delayMs,
          keyboardType: "numeric",
          onChange: (v) => {
            setDelayMs(v);
            const n = parseInt(v, 10);
            if (!isNaN(n)) commit({ delayMs: Math.max(0, Math.min(1500, n)) });
          },
        })
      )
    );
  }

  // ─── Plugin lifecycle ────────────────────────────────────────────────────────
  const plugin = {
    onLoad() {
      subscribe();
    },
    onUnload() {
      unsubscribe();
    },
    settings: SettingsPanel,
  };

  module.exports = plugin;
})();
