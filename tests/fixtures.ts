// Shared test data: a well-formed corrector_scorer answer.
export const goodAnswer = {
  kind: "scored",
  understood: "My day wasn't good.",
  better: "Inniki naal sariyaa pogala.",
  better_english: "Today didn't go well.",
  alternative: null,
  alternative_english: null,
  why: "\"nalla illa\" is fine, but people usually say \"sariyaa pogala\" about a day.",
  hint: "How do people say a day \"didn't go\" well?",
  grammar: 5,
  spoken: 2,
  total: 7,
  mistake_types: ["too literal"],
  care_message: null,
};
