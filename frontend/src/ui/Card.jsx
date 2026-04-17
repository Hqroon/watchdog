import { SURFACE } from "./tokens.js";

export default function Card({ as: Tag = "div", className = "", children, ...props }) {
  const classes = [SURFACE.card, className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}
