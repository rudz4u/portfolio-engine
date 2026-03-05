import ImportWizard from "./import-wizard"

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Holdings</h1>
        <p className="text-muted-foreground">
          Import your holdings from any broker by uploading a file
        </p>
      </div>
      <ImportWizard />
    </div>
  )
}
