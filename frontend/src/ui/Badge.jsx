export default function Badge({ className = "", children }) {
  const classes = ["inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold", className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
