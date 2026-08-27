import RoleGate from "@/components/RoleGate";

export default function TeacherLayout({ children }) {
  return <RoleGate role="teacher">{children}</RoleGate>;
}
