import { exportLongImage } from "@/lib/detail-runs/long-image";
import { handleRouteError } from "@/lib/utils/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return new Response(new Uint8Array(await exportLongImage(params.id)), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="mxpage-detail-${params.id}.jpg"`,
        "Cache-Control": "no-store",
      },
    });
  }
  catch (error) { return handleRouteError(error); }
}
