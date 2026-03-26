export default function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-accent border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}
