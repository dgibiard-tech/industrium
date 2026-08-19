ALTER TABLE "EmployeeContract" ADD CONSTRAINT "EmployeeContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
