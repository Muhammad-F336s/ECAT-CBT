/**
 * PACKAGE FEATURE FLAGS
 * Starter gets ALL features (including Premium-tier) -- per platform policy.
 * Starter is a free trial that showcases everything.
 */

export const PACKAGE_FEATURES = {
  STARTER: {
    vectorBot:         true,
    advancedAnalytics: true,
    contentLibrary:    true,
    pastPapers:        true,
    historicalReview:  true,
    fullSimulator:     true,
  },
  BASIC: {
    vectorBot:         false,   // locked -- upgrade to Premium
    advancedAnalytics: false,   // only basic analytics
    contentLibrary:    true,
    pastPapers:        true,
    historicalReview:  true,
    fullSimulator:     true,
  },
  STANDARD: {
    vectorBot:         false,   // locked -- upgrade to Premium
    advancedAnalytics: true,
    contentLibrary:    true,
    pastPapers:        true,
    historicalReview:  true,
    fullSimulator:     true,
  },
  PREMIUM: {
    vectorBot:         true,
    advancedAnalytics: true,
    contentLibrary:    true,
    pastPapers:        true,
    historicalReview:  true,
    fullSimulator:     true,
  },
};

/** Get features for a package type. Falls back to STARTER (full) for unknown types. */
export const getFeaturesForPackage = (packageType) => {
  return PACKAGE_FEATURES[packageType] ?? PACKAGE_FEATURES.STARTER;
};
