import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BrandTabs } from "./BrandTabs.js";

interface Props {
  children: ReactNode;
  /** Only needed for GG Tiffin's fixed routes (/tiffin-menu, etc.), which carry no :brandId
   * param of their own — every other brand's routes already have one, read automatically. */
  brandId?: string;
}

/** Wraps a brand's own page (Menu Items, Combos, Store Status, or any of GG Tiffin's pages) with
 * the shared tab bar above it — kept as a separate wrapper (rather than rendered inside each page
 * component) so the tabs stay visible even while that page's own content is still loading or
 * errored, and so none of those existing page components needed to change at all. */
export function BrandTabsLayout({ children, brandId: brandIdProp }: Props) {
  const params = useParams<{ brandId: string }>();
  const brandId = brandIdProp ?? params.brandId;
  if (!brandId) return <>{children}</>;

  return (
    <div>
      <BrandTabs brandId={brandId} />
      {children}
    </div>
  );
}
