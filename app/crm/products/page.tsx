import { prisma } from "@/lib/prisma";
import { currentPermissions } from "@/lib/crm-access";
import { CrmProducts } from "@/components/crm/CrmProducts";

export const dynamic = "force-dynamic";

/** /crm/products — product catalog: default price applied when a product is added to a deal. */
export default async function ProductsPage() {
  const [products, permissions] = await Promise.all([
    prisma.crmProduct.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, _count: { select: { dealItems: true } } },
    }),
    currentPermissions(),
  ]);

  return (
    <CrmProducts
      products={products.map((p) => ({ id: p.id, name: p.name, price: p.price.toNumber(), deals: p._count.dealItems }))}
      canManage={permissions.has("product.manage")}
    />
  );
}
