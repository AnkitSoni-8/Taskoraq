export default {
  test: {
    pool: "forks",
    fileParallelism: false, // each file boots its own in-memory MongoDB
    testTimeout: 30000,
    hookTimeout: 240000, // first run downloads a MongoDB binary (cached afterwards)
  },
};
