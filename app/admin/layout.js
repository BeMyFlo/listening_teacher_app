import RoleGate from "@/components/RoleGate";

export default function AdminLayout({ children }) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
