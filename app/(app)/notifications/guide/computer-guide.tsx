import Link from "next/link";
import { accountPath } from "@/lib/account";
import { guideMessages } from "@/lib/activation-guide";
import { qrCodeOf } from "@/lib/guide-qr";

function GuideQrCode({ link }: { link: string }) {
  const { size, path } = qrCodeOf(link);
  return (
    <svg role="img" aria-label={guideMessages.qrLabel} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className="size-56 rounded-sm border border-border">
      <rect className="fill-qr-code-background" width={size} height={size} />
      <path className="fill-qr-code" d={path} />
    </svg>
  );
}

export function ComputerGuide({ link }: { link: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{guideMessages.otherDevice}</p>
      {link ? <GuideQrCode link={link} /> : null}
      <p className="text-sm">{guideMessages.signInOnPhone}</p>
      {link ? (
        <p className="flex flex-col gap-1 text-sm">
          {guideMessages.typeLink}
          <span className="font-medium break-all">{link}</span>
        </p>
      ) : null}
      <p className="text-sm">
        {guideMessages.accountNote}{" "}
        <Link className="underline" href={accountPath}>
          Sua conta
        </Link>
        .
      </p>
    </div>
  );
}
