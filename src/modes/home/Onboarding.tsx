// Onboarding.tsx — 8-question MBTI quiz → registers a pet via petForMBTI.
//
// Shown the first time the user opens Home (no pet.json yet). On Adopt,
// PetContext.adopt() writes pet.json and the Home shell flips to the
// Study view.

import { useMemo, useState } from "react";
import { usePet } from "../../state/PetContext";
import { allPetKinds, petForMBTI } from "./pets";
import { PetSprite } from "../../components/PetSprite";
import type { MBTIType, PetKind } from "./pets";

type Letter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

type Question = {
  a: { text: string; l: Letter };
  b: { text: string; l: Letter };
};

const QUESTIONS: readonly Question[] = [
  { a: { text: "A long stretch of writing in a quiet room",     l: "I" }, b: { text: "A long evening reading aloud with friends",     l: "E" } },
  { a: { text: "Drafting feels like recharging me",             l: "I" }, b: { text: "Drafting feels like emptying me out",           l: "E" } },
  { a: { text: "Books that build worlds from concrete detail",  l: "S" }, b: { text: "Books that build worlds from a single idea",    l: "N" } },
  { a: { text: "I prefer footnotes and citations",              l: "S" }, b: { text: "I prefer aphorisms and gestures",               l: "N" } },
  { a: { text: "A character's choice should follow from logic", l: "T" }, b: { text: "A character's choice should follow from feeling", l: "F" } },
  { a: { text: "Critique sharpens the work",                    l: "T" }, b: { text: "Encouragement sustains the writer",             l: "F" } },
  { a: { text: "I outline before I draft",                      l: "J" }, b: { text: "I discover the shape while drafting",           l: "P" } },
  { a: { text: "A finished chapter, set down and closed",       l: "J" }, b: { text: "An open notebook with seven half-finished entries", l: "P" } },
];

function scoreType(answers: ReadonlyArray<Letter | null>): MBTIType {
  const tally: Record<Letter, number> = { E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0 };
  for (const l of answers) if (l) tally[l]++;
  const pick = (a: Letter, b: Letter): Letter => (tally[a] >= tally[b] ? a : b);
  return (pick("E","I") + pick("S","N") + pick("T","F") + pick("J","P")) as MBTIType;
}

export function Onboarding({ dark }: { dark: boolean }) {
  const { adopt } = usePet();
  const [idx, setIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<(Letter | null)[]>(() => Array(QUESTIONS.length).fill(null));
  const done = idx >= QUESTIONS.length;
  const type = useMemo<MBTIType | null>(() => (done ? scoreType(answers) : null), [done, answers]);
  const pet = type ? petForMBTI(type) : null;

  function choose(l: Letter) {
    const next = answers.slice();
    next[idx] = l;
    setAnswers(next);
    setIdx(idx + 1);
  }

  function retake() {
    setIdx(0);
    setAnswers(Array(QUESTIONS.length).fill(null));
  }

  return (
    <div className="grow flex items-center justify-center p-8 bg-white dark:bg-black text-black dark:text-white">
      <div className="w-[720px] max-w-full">
        {!done ? (
          <QuizStep idx={idx} q={QUESTIONS[idx]} onChoose={choose} />
        ) : (
          pet && type && <Result pet={pet} type={type} dark={dark} onRetake={retake} onAdopt={() => void adopt(pet.id, pet.name)} />
        )}
      </div>
    </div>
  );
}

function QuizStep({ idx, q, onChoose }: { idx: number; q: Question; onChoose: (l: Letter) => void }) {
  return (
    <>
      <div className="flex justify-between font-mono uppercase tracking-widest text-[10px] opacity-55 mb-4">
        <span>◇ Companion · Onboarding</span>
        <span>{idx + 1} / {QUESTIONS.length}</span>
      </div>
      <div className="border border-black dark:border-white h-1.5 mb-9 relative">
        <div className="absolute inset-0 bg-black dark:bg-white transition-[width] duration-300" style={{ width: `${(idx / QUESTIONS.length) * 100}%` }} />
      </div>
      <div className="font-serif italic text-sm opacity-60 mb-4 text-center">Which feels more like you?</div>
      <div className="grid grid-cols-2 gap-4">
        {([q.a, q.b] as const).map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChoose(opt.l)}
            className="border border-black dark:border-white p-6 font-serif text-lg leading-snug text-left min-h-[140px] flex flex-col justify-between shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            <span className="text-pretty">{opt.text}</span>
            <span className="font-mono uppercase tracking-widest text-[10px] opacity-50 mt-4">{i === 0 ? "A ←" : "B →"}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Result({ pet, type, dark, onRetake, onAdopt }: { pet: PetKind; type: MBTIType; dark: boolean; onRetake: () => void; onAdopt: () => void }) {
  return (
    <div className="border border-black dark:border-white p-9 grid grid-cols-2 gap-9 items-center shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,1)]">
      <div className="flex flex-col items-center gap-4">
        <PetSprite kindId={pet.id} mood="happy" hunger={80} dark={dark} size={220} follow={false} />
        <div className="font-mono uppercase tracking-widest text-[10px] opacity-60">{type}</div>
      </div>
      <div>
        <div className="font-mono uppercase tracking-widest text-[10px] opacity-55 mb-2">Meet your companion</div>
        <div className="font-serif font-bold text-5xl leading-none tracking-tight">{pet.name}</div>
        <div className="font-serif italic text-base opacity-70 mt-1">The {pet.species}</div>
        <div className="font-serif text-base mt-4 leading-relaxed text-pretty">"{pet.credo}"</div>
        <div className="text-[10px] opacity-55 font-mono uppercase tracking-widest mt-4">
          {allPetKinds().length} pet kinds registered
        </div>
        <div className="flex gap-2.5 mt-7">
          <button type="button" onClick={onAdopt} className="border border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-mono uppercase tracking-widest text-[11px] px-4 py-2.5 font-bold">
            Adopt {pet.name} →
          </button>
          <button type="button" onClick={onRetake} className="border border-black dark:border-white font-mono uppercase tracking-widest text-[11px] px-4 py-2.5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
            Retake
          </button>
        </div>
      </div>
    </div>
  );
}
