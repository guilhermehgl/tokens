declare module "mjml" {
  const mjml2html: (mjml: string) => Promise<{ html: string; errors: unknown[] }>;
  export default mjml2html;
}
