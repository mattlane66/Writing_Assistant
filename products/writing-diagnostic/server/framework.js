'use strict';

const PRIMITIVES = {
  Perception: { family: 'seeing', question: 'What has actually been noticed?' },
  Reference: { family: 'seeing', question: 'What exactly does this word point to?' },
  Particularity: { family: 'seeing', question: 'Has the thing been named as specifically as the writer actually knows it?' },
  Distinction: { family: 'seeing', question: 'Are meaningful differences being kept separate?' },
  Agency: { family: 'truth', question: 'Who or what actually acts?' },
  Support: { family: 'truth', question: 'What warrants this claim?' },
  Calibration: { family: 'truth', question: 'Does the strength of the language match what is known?' },
  Relation: { family: 'reasoning', question: 'What relationship is being asserted?' },
  Mechanism: { family: 'reasoning', question: 'By what process does one thing produce or affect another?' },
  Implication: { family: 'reasoning', question: 'What does the sentence say, not say, and cause the reader to infer?' },
  Construction: { family: 'sentence', question: 'Was this sentence consciously made for this thought, or did a familiar shape volunteer itself?' },
  Necessity: { family: 'sentence', question: 'Does every word, phrase, sentence, and example earn its place?' },
  Function: { family: 'sentence', question: 'What work is this unit doing?' },
  Architecture: { family: 'piece', question: 'Is the thinking arranged in the order it requires?' },
  Emphasis: { family: 'piece', question: 'Is the right thing receiving the right amount of weight?' },
  Distinctness: { family: 'piece', question: "Does the prose reflect this writer's actual attention, judgment, selection, and way of seeing?" },
  'Reader fit': { family: 'piece', question: 'What does this reader need made explicit, and what can safely remain implicit?' },
  'Intellectual honesty': { family: 'honesty', question: 'Is the language revealing the thought, or helping conceal its weaknesses?' }
};

module.exports = { PRIMITIVES };
