# Static TS
The goal of this collection of functions is taking what we currently enter in NAV and generate some useful reporting on it. I currently do that using a .NET app on Kubernetes, and it's a bit heavy and expensive. The goal here would be that the reports are only ever regenerated when a part of it changes.

We're using the usual contortions of the last few projects, but this time around we'll extract the clientside code in a completely separate project since last time Azure got confused.

	az group create --name staticTS --location westeurope
	az storage account create --name staticts --location westeurope --resource-group staticTS --sku Standard_LRS
	az functionapp create --name StaticTS --storage-account staticts --resource-group staticTS --consumption-plan-location westeurope

Again with a storage container

	az storage container create --name statictscontent
	az storage container set-permission --name statictscontent --public-access blob

