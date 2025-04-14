function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
              About the Analytics Solutions Center
            </h1>
            <div className="max-w-[800px] space-y-6 text-left">
              <p className="text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                The Analytics Solutions Center (ASC) is dedicated to supporting students in their academic journey.
              </p>
              <h2 className="text-2xl font-bold">Development Opportunities</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-500">
                <li>Professional Development Workshops</li>
                <li>Leadership Training</li>
                <li>Peer Mentoring Programs</li>
                <li>Academic Skills Enhancement</li>
                <li>Career Preparation Resources</li>
              </ul>
              <p className="text-gray-500">
                Through these programs, students can develop essential skills, build professional networks,
                and prepare for successful careers while supporting their peers.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutPage 