import RoleGate from "@/components/RoleGate";

export default function StudentLayout({ children }) {
  return <RoleGate role="student">{children}</RoleGate>;
}
