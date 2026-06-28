interface Props {
  text: string;
  dark?: boolean;
}

const CSS =
  "@keyframes snwTelop { from { transform: translateX(0); } to { transform: translateX(-100%); } }";

export default function Telop({ text, dark = false }: Props) {
  if (!text) return null;
  return (
    <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        background: dark ? "rgba(20,26,36,0.72)" : "var(--accent-soft, #fff3bf)",
        borderTop: "1px solid " + (dark ? "rgba(255,214,102,0.28)" : "var(--accent, #ffe066)"),
        borderBottom: "1px solid " + (dark ? "rgba(255,214,102,0.28)" : "var(--accent, #ffe066)"),
        padding: "6px 0",
        margin: "8px 0",
        fontSize: 14,
        color: dark ? "#ffd86b" : "var(--accent-strong, #b45309)",
        fontWeight: 600,
        backdropFilter: dark ? "blur(8px)" : undefined,
        WebkitBackdropFilter: dark ? "blur(8px)" : undefined,
      }}
    >
      <style>{CSS}</style>
      <div
        style={{
          display: "inline-block",
          paddingLeft: "100%",
          animation: "snwTelop 30s linear infinite",
        }}
      >
        {text}
      </div>
    </div>
  );
}
