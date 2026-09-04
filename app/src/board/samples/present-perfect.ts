import type { BoardScript } from '../types';

// The §8.2 illustrative script, transcribed verbatim. Used to build and test the
// renderer before the generation pipeline (Phase 4) exists. It exercises every
// piece: a persistent story scene (beats 2–5), recap with emphasis, formula,
// example, common mistake, two check-in questions, and (Phase 5) a blended,
// beat-tagged end-of-topic quiz (§8.4) so the offline sample runs the full flow.
export const presentPerfectSample: BoardScript = {
  topic_id: 'present_perfect',
  level: 'A2',
  beats: [
    { id: 1, type: 'formal_beat', style: 'title', content: 'Present Perfect' },
    {
      id: 2,
      type: 'story_beat',
      narration:
        "Today we're looking at present perfect. I'll show you a few situations, then we'll figure out the rule together.",
      doodles: [],
    },
    {
      id: 3,
      type: 'story_beat',
      narration: 'Diana just got back from a trip. Her friend Marcus wants to know how it went.',
      doodles: [
        { element_id: 'person_a', position: 'left' },
        { element_id: 'suitcase', position: 'left', attached_to: 'person_a' },
        { element_id: 'person_b', position: 'right' },
        { element_id: 'speech_bubble', attached_to: 'person_b', text: 'How was your trip?' },
      ],
    },
    {
      id: 4,
      type: 'story_beat',
      narration:
        "Diana smiles — the trip already happened, but she's still talking about it right now, so she says it this way.",
      doodles: [
        { element_id: 'face_happy', attached_to: 'person_a' },
        { element_id: 'speech_bubble', attached_to: 'person_a', text: "I've visited Samarkand!" },
      ],
    },
    {
      id: 5,
      type: 'story_beat',
      narration: "Marcus grins back — he's got a similar story of his own.",
      doodles: [
        { element_id: 'face_happy', attached_to: 'person_b' },
        { element_id: 'speech_bubble', attached_to: 'person_b', text: "I've been to Bukhara myself!" },
      ],
    },
    { id: 6, type: 'formal_beat', style: 'recap_example', content: 'I have visited Samarkand.', emphasis: 'have' },
    { id: 7, type: 'formal_beat', style: 'recap_example', content: 'I have been to Bukhara.', emphasis: 'have' },
    {
      id: 8,
      type: 'formal_beat',
      style: 'check_in_question',
      question: "Which sentence connects a past trip to right now, the same way Diana's and Marcus's did?",
      options: ['I visited Samarkand last year.', 'I have visited Samarkand.'],
      correct_index: 1,
      wrong_answer_reactions: {
        '0': "That's simple past — it works, but it ties the action to a finished, specific time. Diana and Marcus were both talking about it as something that still matters right now, which needs 'have' or 'has' plus the past participle instead.",
      },
    },
    { id: 9, type: 'formal_beat', style: 'formula', content: 'have / has + past participle' },
    { id: 10, type: 'formal_beat', style: 'example', content: 'I have visited Samarkand.' },
    { id: 11, type: 'formal_beat', style: 'common_mistake', content: 'I have visit Samarkand.' },
    {
      id: 12,
      type: 'formal_beat',
      style: 'check_in_question',
      question: 'Which sentence is correct?',
      options: ['I have went to Samarkand.', 'I have gone to Samarkand.'],
      correct_index: 1,
      wrong_answer_reactions: {
        '0': "Ah, close — 'went' is what we'd use for simple past, but since this is still connected to right now, we need the past participle: 'gone.'",
      },
    },
  ],
  quiz: [
    {
      quiz_question_id: 1,
      type: 'fill_in_the_blank',
      question: 'She ___ (visit) Samarkand three times this year.',
      accepted_answers: ['has visited'],
      tests_beat_id: 9,
    },
    {
      quiz_question_id: 2,
      type: 'multiple_choice',
      question: 'Which sentence is correct?',
      options: ['I have went to Samarkand.', 'I have gone to Samarkand.'],
      correct_index: 1,
      tests_beat_id: 12,
    },
    {
      quiz_question_id: 3,
      type: 'true_false',
      question: '"I have visit Samarkand" is correct.',
      options: ['True', 'False'],
      correct_index: 1,
      tests_beat_id: 11,
    },
    {
      quiz_question_id: 4,
      type: 'multiple_choice',
      question: 'Present perfect connects a past action to ___.',
      options: ['a finished, specific past time', 'right now'],
      correct_index: 1,
      tests_beat_id: 6,
    },
    {
      quiz_question_id: 5,
      type: 'fill_in_the_blank',
      question: 'Complete: I ___ (be) to Bukhara.',
      accepted_answers: ['have been'],
      tests_beat_id: 7,
    },
    {
      quiz_question_id: 6,
      type: 'multiple_choice',
      question: 'Which is the present perfect formula?',
      options: ['have / has + past participle', 'did + base verb'],
      correct_index: 0,
      tests_beat_id: 9,
    },
    {
      quiz_question_id: 7,
      type: 'true_false',
      question: '"I have visited Samarkand" links a past trip to the present.',
      options: ['True', 'False'],
      correct_index: 0,
      tests_beat_id: 10,
    },
    {
      quiz_question_id: 8,
      type: 'fill_in_the_blank',
      question: 'Marcus said he ___ (be) to Bukhara himself.',
      accepted_answers: ['has been'],
      tests_beat_id: 5,
    },
    {
      quiz_question_id: 9,
      type: 'multiple_choice',
      question: 'Which sentence uses the present perfect?',
      options: ['I visited Samarkand last year.', 'I have visited Samarkand.'],
      correct_index: 1,
      tests_beat_id: 8,
    },
    {
      quiz_question_id: 10,
      type: 'true_false',
      question: 'Present perfect uses the past participle, not the simple past form.',
      options: ['True', 'False'],
      correct_index: 0,
      tests_beat_id: 11,
    },
  ],
};
