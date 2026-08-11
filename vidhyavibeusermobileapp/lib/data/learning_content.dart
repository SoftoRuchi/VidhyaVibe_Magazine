import 'package:flutter/material.dart';

/// Hands-on learning subjects featured in VidhyaVibe magazines.
class LearningSubject {
  const LearningSubject({
    required this.id,
    required this.title,
    required this.tagline,
    required this.description,
    required this.icon,
    required this.color,
    required this.activities,
  });

  final String id;
  final String title;
  final String tagline;
  final String description;
  final IconData icon;
  final Color color;
  final List<LearningActivity> activities;
}

class LearningActivity {
  const LearningActivity({
    required this.title,
    required this.summary,
    required this.skills,
    this.minutes = 20,
    this.difficulty = 'Easy',
    this.needsAdult = false,
  });

  final String title;
  final String summary;
  final List<String> skills;
  final int minutes;
  final String difficulty;
  final bool needsAdult;
}

class LearningContent {
  LearningContent._();

  static const mission =
      'We want children to actively learn through fun, hands-on activities '
      'that make education exciting and engaging. Every activity helps kids '
      'learn concepts in a practical way while building creativity, curiosity, '
      'and problem-solving skills.';

  static const subjects = <LearningSubject>[
    LearningSubject(
      id: 'chemistry',
      title: 'Chemistry',
      tagline: 'Safe kitchen-table experiments',
      description:
          'Explore reactions, colours, and materials with safe, supervised '
          'experiments that turn curiosity into real science.',
      icon: Icons.science_outlined,
      color: Color(0xFF2F6F8F),
      activities: [
        LearningActivity(
          title: 'Fizzing volcano',
          summary:
              'Mix baking soda and vinegar to see a chemical reaction bubble up — then talk about acids and bases.',
          skills: ['Observation', 'Cause & effect'],
          minutes: 15,
          needsAdult: true,
        ),
        LearningActivity(
          title: 'Colour-changing cabbage juice',
          summary:
              'Use red cabbage water as a natural pH indicator with lemon and soap water.',
          skills: ['Chemistry basics', 'Comparing results'],
          minutes: 25,
          needsAdult: true,
          difficulty: 'Medium',
        ),
        LearningActivity(
          title: 'Homemade slime science',
          summary:
              'Make stretchy slime and learn about polymers — solids that behave like liquids.',
          skills: ['Materials science', 'Following steps'],
          minutes: 30,
          needsAdult: true,
        ),
      ],
    ),
    LearningSubject(
      id: 'physics',
      title: 'Physics',
      tagline: 'Simple projects that move',
      description:
          'Build, push, roll, and launch — discover force, motion, light, and energy through DIY projects.',
      icon: Icons.bolt_outlined,
      color: Color(0xFFC47A1A),
      activities: [
        LearningActivity(
          title: 'Paper aeroplane challenge',
          summary:
              'Fold 3 designs, fly them, and measure which travels farthest — then tweak the wings.',
          skills: ['Aerodynamics', 'Measuring', 'Iteration'],
          minutes: 20,
        ),
        LearningActivity(
          title: 'Balloon rocket',
          summary:
              'Thread a balloon on a string and race it across the room to feel thrust in action.',
          skills: ['Force & motion', 'Prediction'],
          minutes: 15,
        ),
        LearningActivity(
          title: 'Shadow puppet theatre',
          summary:
              'Use a torch and cut-outs to explore how light travels and shadows grow.',
          skills: ['Light', 'Storytelling'],
          minutes: 25,
        ),
      ],
    ),
    LearningSubject(
      id: 'mathematics',
      title: 'Mathematics',
      tagline: 'Puzzles from real life',
      description:
          'Math becomes a game — puzzles, patterns, money sense, and logic that kids can use every day.',
      icon: Icons.calculate_outlined,
      color: Color(0xFF2D7A3E),
      activities: [
        LearningActivity(
          title: 'Market maths mission',
          summary:
              'Plan a ₹100 shopping list, compare prices, and spot the best deals.',
          skills: ['Addition', 'Budgeting'],
          minutes: 20,
        ),
        LearningActivity(
          title: 'Pattern detective',
          summary:
              'Find repeating patterns in floor tiles, rangoli, and phone numbers — then invent your own.',
          skills: ['Patterns', 'Logic'],
          minutes: 15,
        ),
        LearningActivity(
          title: 'Fraction pizza party',
          summary:
              'Cut paper “pizzas” into halves, thirds, and quarters and share fairly.',
          skills: ['Fractions', 'Sharing'],
          minutes: 25,
          difficulty: 'Medium',
        ),
      ],
    ),
    LearningSubject(
      id: 'english',
      title: 'English',
      tagline: 'Word games & storytelling',
      description:
          'Build vocabulary, confidence, and clear expression through games, comics, and mini stories.',
      icon: Icons.menu_book_outlined,
      color: Color(0xFF5B4B8A),
      activities: [
        LearningActivity(
          title: 'Story dice',
          summary:
              'Roll picture prompts and invent a 5-sentence adventure out loud.',
          skills: ['Speaking', 'Creativity'],
          minutes: 15,
        ),
        LearningActivity(
          title: 'Synonym scavenger hunt',
          summary:
              'Replace boring words in a paragraph with stronger, more precise ones.',
          skills: ['Vocabulary', 'Editing'],
          minutes: 20,
        ),
        LearningActivity(
          title: 'Comic caption challenge',
          summary:
              'Write funny or thoughtful captions for a 4-panel comic strip.',
          skills: ['Writing', 'Humour'],
          minutes: 20,
        ),
      ],
    ),
    LearningSubject(
      id: 'hindi',
      title: 'Hindi',
      tagline: 'भाषा के खेल',
      description:
          'मज़ेदार शब्द खेल, कविता और कहानियों से हिंदी पढ़ना-लिखना और बोलना आसान बनाएँ।',
      icon: Icons.translate_outlined,
      color: Color(0xFFA65D2E),
      activities: [
        LearningActivity(
          title: 'अक्षर खोज',
          summary:
              'घर के अंदर हिंदी अक्षरों वाले लेबल ढूँढो और नए शब्द बनाओ।',
          skills: ['वर्णमाला', 'शब्दावली'],
          minutes: 15,
        ),
        LearningActivity(
          title: 'कविता पूरा करो',
          summary:
              'एक अधूरी कविता पढ़ो और अपनी पंक्ति जोड़कर लय बनाए रखो।',
          skills: ['कविता', 'कल्पना'],
          minutes: 20,
        ),
        LearningActivity(
          title: 'कहानी का अंत बदलो',
          summary:
              'जानी-पहचानी कहानी का नया अंत लिखो या सुनाओ।',
          skills: ['कहानी लेखन', 'बोलना'],
          minutes: 25,
        ),
      ],
    ),
    LearningSubject(
      id: 'drawing',
      title: 'Drawing',
      tagline: 'Lines that tell stories',
      description:
          'From doodles to design — practice observation, proportion, and visual storytelling.',
      icon: Icons.edit_outlined,
      color: Color(0xFF3D6B8A),
      activities: [
        LearningActivity(
          title: 'Blind contour portrait',
          summary:
              'Draw a family member without looking at the paper — laugh, then try again with eyes open.',
          skills: ['Observation', 'Hand-eye coordination'],
          minutes: 15,
        ),
        LearningActivity(
          title: 'One-line city',
          summary:
              'Draw a skyline without lifting your pencil — train continuous line control.',
          skills: ['Control', 'Creativity'],
          minutes: 10,
        ),
        LearningActivity(
          title: 'Nature sketch walk',
          summary:
              'Pick one leaf or flower and sketch it from three angles.',
          skills: ['Detail', 'Patience'],
          minutes: 25,
        ),
      ],
    ),
    LearningSubject(
      id: 'painting',
      title: 'Painting',
      tagline: 'Colour, texture & mood',
      description:
          'Explore colour mixing, moods, and expression with paint, stamps, and homemade tools.',
      icon: Icons.palette_outlined,
      color: Color(0xFFB04A6A),
      activities: [
        LearningActivity(
          title: 'Colour-wheel spinner',
          summary:
              'Mix primary colours to make secondary ones and paint a simple colour wheel.',
          skills: ['Colour theory', 'Mixing'],
          minutes: 30,
          needsAdult: true,
        ),
        LearningActivity(
          title: 'Mood weather painting',
          summary:
              'Paint today’s weather as a feeling — sunny joy, rainy calm, stormy energy.',
          skills: ['Expression', 'Emotion vocabulary'],
          minutes: 25,
        ),
        LearningActivity(
          title: 'Stamp art from nature',
          summary:
              'Use leaves and potato stamps to print repeating patterns.',
          skills: ['Pattern', 'Texture'],
          minutes: 30,
          needsAdult: true,
        ),
      ],
    ),
    LearningSubject(
      id: 'diy',
      title: 'DIY & Crafts',
      tagline: 'Make it with your hands',
      description:
          'Recycle, build, and invent — crafts that sharpen planning, fine motor skills, and pride in finishing.',
      icon: Icons.handyman_outlined,
      color: Color(0xFF5C7A3A),
      activities: [
        LearningActivity(
          title: 'Cardboard marble maze',
          summary:
              'Build a maze from scrap cardboard and race a marble from start to finish.',
          skills: ['Design', 'Problem-solving'],
          minutes: 40,
          difficulty: 'Medium',
          needsAdult: true,
        ),
        LearningActivity(
          title: 'Recycled robot',
          summary:
              'Turn bottle caps and boxes into a character with moving arms.',
          skills: ['Recycling', 'Imagination'],
          minutes: 35,
        ),
        LearningActivity(
          title: 'Friendship bookmark',
          summary:
              'Decorate a bookmark and write a kind note for someone at home.',
          skills: ['Craft', 'Kindness'],
          minutes: 20,
        ),
      ],
    ),
  ];
}
