interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getColor(name?: string) {
  const colors = [
    "from-purple-500 to-indigo-500",
    "from-pink-500 to-rose-500",
    "from-amber-500 to-orange-500",
    "from-emerald-500 to-teal-500",
    "from-sky-500 to-blue-500",
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function Avatar({ src, name, size = 36, className = "" }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.35 };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "avatar"}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${getColor(name)} flex items-center justify-center font-semibold text-white shrink-0 ${className}`}
      style={style}
    >
      {getInitials(name)}
    </div>
  );
}
