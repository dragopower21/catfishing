"use client";

type Hint = { text: string; custom: boolean };

type Props = {
  categories: string[];
  customHints?: string[];
  stickerLabel?: string;
};

export default function CategoryList({
  categories,
  customHints = [],
  stickerLabel = "Categories",
}: Props) {
  const hints: Hint[] = [
    ...customHints.map((text) => ({ text, custom: true })),
    ...categories.map((text) => ({ text, custom: false })),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="brut-sticker bg-accent-yellow text-slate-900">
          {stickerLabel}
        </span>
        {customHints.length > 0 && (
          <span className="brut-sticker bg-accent-green text-slate-900">
            {customHints.length} custom
          </span>
        )}
      </div>
      <p
        className="text-[17px] leading-[1.9] text-slate-900"
        style={{ textWrap: "pretty" }}
      >
        {hints.map((h, i) => (
          <span key={`${h.text}-${i}`} className="whitespace-normal">
            <span
              className={
                h.custom
                  ? "rounded-sm bg-accent-green/45 px-1 font-bold text-slate-900"
                  : "font-semibold"
              }
            >
              {h.text}
            </span>
            {i < hints.length - 1 && (
              <span
                className="mx-2.5 inline-block align-middle text-slate-400"
                aria-hidden
              >
                ✦
              </span>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
