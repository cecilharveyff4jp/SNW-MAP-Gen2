interface Props {
  text: string;
}

const CSS =
  "@keyframes snwTelop { from { transform: translateX(0); } to { transform: translateX(-100%); } }";

export default function Telop({ text }: Props) {
  if (!text) return null;
  return (
    <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        background: "var(--accent-soft, #fff3bf)",
        borderTop: "1px solid var(--accent, #ffe066)",
        borderBottom: "1px solid var(--accent, #ffe066)",
        padding: "6px 0",
        margin: "8px 0",
        fontSize: 14,
        color: "var(--accent-strong, #b45309)",
        fontWeight: 600,
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
