interface Props {
  text: string;
}

const CSS =
  "@keyframes snwTelop { from { transform: translateX(100%); } to { transform: translateX(-100%); } }";

export default function Telop({ text }: Props) {
  if (!text) return null;
  return (
    <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        background: "#fff3bf",
        borderTop: "1px solid #ffe066",
        borderBottom: "1px solid #ffe066",
        padding: "6px 0",
        margin: "8px 0",
        fontSize: 14,
        color: "#b45309",
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
