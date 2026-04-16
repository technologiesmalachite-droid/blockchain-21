export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const primaryMessage = issues[0]?.message || "Invalid request data.";

    if (process.env.NODE_ENV !== "production" && req.originalUrl.includes("/auth/register")) {
      console.log("register validation error:", result.error);
    }

    return res.status(400).json({
      message: primaryMessage,
      code: "validation_error",
      issues,
    });
  }

  req.validated = result.data;
  next();
};
