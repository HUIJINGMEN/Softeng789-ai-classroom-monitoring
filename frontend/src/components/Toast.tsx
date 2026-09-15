export default function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <output className="toast">
      {message}
    </output>
  );
}
